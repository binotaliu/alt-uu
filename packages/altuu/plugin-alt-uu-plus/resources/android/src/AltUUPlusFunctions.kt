package com.altuu.plugins.altuuplus

import android.app.Activity
import androidx.fragment.app.FragmentActivity
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.android.billingclient.api.acknowledgePurchase
import com.android.billingclient.api.queryProductDetails
import com.android.billingclient.api.queryPurchasesAsync
import com.nativephp.mobile.bridge.BridgeError
import com.nativephp.mobile.bridge.BridgeFunction
import com.nativephp.mobile.bridge.BridgeResponse
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray

// region Billing Manager

object BillingManager : PurchasesUpdatedListener {
    private var client: BillingClient? = null

    // Set only while a launchBillingFlow() call is awaiting its PurchasesUpdatedListener
    // callback - onPurchasesUpdated() is the only way that result reaches us.
    @Volatile
    private var pendingPurchaseResult: CompletableDeferred<List<Purchase>>? = null

    @Synchronized
    private fun ensureClient(activity: Activity): BillingClient {
        client?.let { return it }

        val newClient = BillingClient.newBuilder(activity.applicationContext)
            .setListener(this)
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder()
                    .enableOneTimeProducts()
                    .build(),
            )
            .build()

        client = newClient
        return newClient
    }

    private suspend fun connect(activity: Activity): BillingClient {
        val billingClient = ensureClient(activity)

        if (billingClient.isReady) {
            return billingClient
        }

        val connected = CompletableDeferred<Boolean>()

        billingClient.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                connected.complete(result.responseCode == BillingClient.BillingResponseCode.OK)
            }

            override fun onBillingServiceDisconnected() {
                if (!connected.isCompleted) {
                    connected.complete(false)
                }
            }
        })

        val connectedOk = withTimeoutOrNull(15_000) { connected.await() } ?: false

        if (!connectedOk) {
            throw BridgeError.ExecutionFailed("Unable to connect to Google Play Billing")
        }

        return billingClient
    }

    suspend fun fetchProductDetails(activity: Activity, productIds: List<String>): List<ProductDetails> {
        val billingClient = connect(activity)

        val products = productIds.map { id ->
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(id)
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
        }

        val params = QueryProductDetailsParams.newBuilder().setProductList(products).build()
        val result = billingClient.queryProductDetails(params)

        if (result.billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
            throw BridgeError.ExecutionFailed(
                "Unable to load products (${result.billingResult.responseCode}): ${result.billingResult.debugMessage}",
            )
        }

        return result.productDetailsList ?: emptyList()
    }

    suspend fun purchase(activity: FragmentActivity, productId: String): List<Purchase> {
        val billingClient = connect(activity)
        val details = fetchProductDetails(activity, listOf(productId)).firstOrNull()
            ?: throw BridgeError.ExecutionFailed("Product not found in Play Console configuration")

        val offerToken = details.subscriptionOfferDetails?.firstOrNull()?.offerToken
            ?: throw BridgeError.ExecutionFailed("No subscription offer available for this product")

        val productDetailsParams = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(details)
            .setOfferToken(offerToken)
            .build()

        val flowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(productDetailsParams))
            .build()

        val deferred = CompletableDeferred<List<Purchase>>()
        pendingPurchaseResult = deferred

        val launchResult = billingClient.launchBillingFlow(activity, flowParams)

        if (launchResult.responseCode != BillingClient.BillingResponseCode.OK) {
            pendingPurchaseResult = null
            throw BridgeError.ExecutionFailed("Unable to launch purchase flow: ${launchResult.debugMessage}")
        }

        // Purchase flow may wait on PIN/biometric confirmation, so allow more time than a
        // plain data fetch before giving up.
        val purchases = withTimeoutOrNull(120_000) { deferred.await() } ?: emptyList()

        purchases.forEach { acknowledgeIfNeeded(billingClient, it) }

        return purchases
    }

    suspend fun currentPurchases(activity: Activity): List<Purchase> {
        val billingClient = connect(activity)
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.SUBS)
            .build()

        return billingClient.queryPurchasesAsync(params).purchasesList
    }

    private suspend fun acknowledgeIfNeeded(billingClient: BillingClient, purchase: Purchase) {
        if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED && !purchase.isAcknowledged) {
            val params = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(purchase.purchaseToken)
                .build()

            billingClient.acknowledgePurchase(params)
        }
    }

    override fun onPurchasesUpdated(billingResult: BillingResult, purchases: MutableList<Purchase>?) {
        val deferred = pendingPurchaseResult ?: return
        pendingPurchaseResult = null

        if (billingResult.responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
            deferred.complete(purchases)
        } else {
            deferred.complete(emptyList())
        }
    }
}

// endregion

// region Bridge Functions

private fun Purchase.toBridgeMap(): Map<String, Any> = mapOf(
    "productIds" to this.products,
    "purchaseToken" to this.purchaseToken,
    "orderId" to (this.orderId ?: ""),
    "isAcknowledged" to this.isAcknowledged,
    "purchaseState" to this.purchaseState,
)

object AltUUPlusFunctions {

    class FetchProducts(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            // The bridge parses parameters with org.json, so arrays arrive as JSONArray, not List.
            val productIds = when (val raw = parameters["productIds"]) {
                is JSONArray -> (0 until raw.length()).map { raw.getString(it) }
                is List<*> -> raw.filterIsInstance<String>()
                else -> null
            } ?: throw BridgeError.InvalidParameters("Missing productIds parameter")

            val products = runBlocking { BillingManager.fetchProductDetails(activity, productIds) }

            val payload = products.map { details ->
                val pricingPhase = details.subscriptionOfferDetails
                    ?.firstOrNull()
                    ?.pricingPhases
                    ?.pricingPhaseList
                    ?.firstOrNull()

                mapOf(
                    "id" to details.productId,
                    "displayName" to details.name,
                    "description" to details.description,
                    "displayPrice" to (pricingPhase?.formattedPrice ?: ""),
                    "price" to ((pricingPhase?.priceAmountMicros ?: 0L) / 1_000_000.0),
                )
            }

            return BridgeResponse.success(mapOf("products" to payload))
        }
    }

    class Purchase(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            val productId = parameters["productId"] as? String
                ?: throw BridgeError.InvalidParameters("Missing productId parameter")

            val purchases = runBlocking { BillingManager.purchase(activity, productId) }
            val purchase = purchases.firstOrNull()
                ?: return BridgeResponse.success(mapOf("status" to "cancelled"))

            return BridgeResponse.success(
                mapOf(
                    "status" to "purchased",
                    "purchaseToken" to purchase.purchaseToken,
                    "productId" to (purchase.products.firstOrNull() ?: productId),
                    "orderId" to (purchase.orderId ?: ""),
                ),
            )
        }
    }

    class RestorePurchases(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            val purchases = runBlocking { BillingManager.currentPurchases(activity) }

            return BridgeResponse.success(mapOf("entitlements" to purchases.map { it.toBridgeMap() }))
        }
    }

    class CurrentEntitlements(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            val purchases = runBlocking { BillingManager.currentPurchases(activity) }

            return BridgeResponse.success(mapOf("entitlements" to purchases.map { it.toBridgeMap() }))
        }
    }
}

// endregion
