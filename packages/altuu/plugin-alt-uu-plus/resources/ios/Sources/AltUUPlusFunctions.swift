import Foundation
import StoreKit

enum AltUUPlusFunctions {

    class FetchProducts: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            guard let productIds = parameters["productIds"] as? [String], !productIds.isEmpty else {
                throw NSError(domain: "AltUUPlus", code: 422, userInfo: [NSLocalizedDescriptionKey: "Missing productIds parameter"])
            }

            let semaphore = DispatchSemaphore(value: 0)
            var payload: [[String: Any]] = []
            var fetchError: Error?

            Task {
                do {
                    let products = try await Product.products(for: productIds)
                    DebugLogger.shared.log("[alt-uu-plus] Product.products(for: \(productIds)) returned \(products.count) product(s): \(products.map(\.id))")
                    if products.isEmpty {
                        let storefront = await Storefront.current
                        DebugLogger.shared.log("[alt-uu-plus] empty result context: canMakePayments=\(AppStore.canMakePayments) storefront=\(storefront?.countryCode ?? "nil") bundleId=\(Bundle.main.bundleIdentifier ?? "nil")")
                    }
                    payload = products.map { product in
                        [
                            "id": product.id,
                            "displayName": product.displayName,
                            "description": product.description,
                            "displayPrice": product.displayPrice,
                            "price": NSDecimalNumber(decimal: product.price).doubleValue,
                        ]
                    }
                } catch {
                    DebugLogger.shared.log("[alt-uu-plus] Product.products(for: \(productIds)) threw: \(error)")
                    fetchError = error
                }
                semaphore.signal()
            }

            _ = semaphore.wait(timeout: .now() + 15)

            if let fetchError {
                throw NSError(domain: "AltUUPlus", code: 502, userInfo: [NSLocalizedDescriptionKey: "Failed to fetch products: \(fetchError.localizedDescription)"])
            }

            return BridgeResponse.success(data: ["products": payload])
        }
    }

    class Purchase: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            guard let productId = parameters["productId"] as? String, !productId.isEmpty else {
                throw NSError(domain: "AltUUPlus", code: 422, userInfo: [NSLocalizedDescriptionKey: "Missing productId parameter"])
            }

            let semaphore = DispatchSemaphore(value: 0)
            var resultPayload: [String: Any] = ["status": "unknown"]
            var purchaseError: Error?

            Task {
                do {
                    let products = try await Product.products(for: [productId])

                    guard let product = products.first else {
                        throw AltUUPlusError.productNotFound
                    }

                    let result = try await product.purchase()

                    switch result {
                    case .success(let verification):
                        let transaction = try AltUUPlusFunctions.checkVerified(verification)

                        resultPayload = [
                            "status": "purchased",
                            "transactionId": String(transaction.id),
                            "originalTransactionId": String(transaction.originalID),
                            "productId": transaction.productID,
                            "jws": verification.jwsRepresentation,
                        ]

                        await transaction.finish()
                    case .userCancelled:
                        resultPayload = ["status": "cancelled"]
                    case .pending:
                        resultPayload = ["status": "pending"]
                    @unknown default:
                        resultPayload = ["status": "unknown"]
                    }
                } catch {
                    purchaseError = error
                }
                semaphore.signal()
            }

            // Purchase flow may wait on Face ID / Ask to Buy / bank auth, so allow more time
            // than a plain data fetch before giving up.
            _ = semaphore.wait(timeout: .now() + 120)

            if let purchaseError {
                throw NSError(domain: "AltUUPlus", code: 502, userInfo: [NSLocalizedDescriptionKey: "Purchase failed: \(purchaseError.localizedDescription)"])
            }

            return BridgeResponse.success(data: resultPayload)
        }
    }

    class RestorePurchases: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            let semaphore = DispatchSemaphore(value: 0)
            var syncError: Error?

            Task {
                do {
                    try await AppStore.sync()
                } catch {
                    syncError = error
                }
                semaphore.signal()
            }

            _ = semaphore.wait(timeout: .now() + 30)

            if let syncError {
                throw NSError(domain: "AltUUPlus", code: 502, userInfo: [NSLocalizedDescriptionKey: "Restore failed: \(syncError.localizedDescription)"])
            }

            return try CurrentEntitlements().execute(parameters: parameters)
        }
    }

    class CurrentEntitlements: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            let semaphore = DispatchSemaphore(value: 0)
            var payload: [[String: Any]] = []

            Task {
                for await result in Transaction.currentEntitlements {
                    if let transaction = try? AltUUPlusFunctions.checkVerified(result) {
                        payload.append([
                            "transactionId": String(transaction.id),
                            "originalTransactionId": String(transaction.originalID),
                            "productId": transaction.productID,
                            "jws": result.jwsRepresentation,
                        ])
                    }
                }
                semaphore.signal()
            }

            _ = semaphore.wait(timeout: .now() + 15)

            return BridgeResponse.success(data: ["entitlements": payload])
        }
    }

    static func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            throw AltUUPlusError.failedVerification
        case .verified(let safe):
            return safe
        }
    }
}

private enum AltUUPlusError: LocalizedError {
    case productNotFound
    case failedVerification

    var errorDescription: String? {
        switch self {
        case .productNotFound:
            return "Product not found in App Store Connect configuration."
        case .failedVerification:
            return "Transaction verification failed."
        }
    }
}
