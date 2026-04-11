import Foundation

// MARK: - Media Player Data Models

struct MediaPlayerData: Codable {
    let url: String
    let type: String // "audio" or "video"
    let frame: MediaPlayerFrame
    let courseName: String?
    let materialName: String?
    let appearance: String?
    let sessionContext: MediaPlayerSessionContext?
}

struct MediaPlayerSessionContext: Codable {
    let routePath: String?
    let cid: String?
    let activityId: String?
    let href: String?
    let startedAt: String?

    func asDictionary() -> [String: Any] {
        var dictionary: [String: Any] = [:]

        if let routePath {
            dictionary["routePath"] = routePath
        }

        if let cid {
            dictionary["cid"] = cid
        }

        if let activityId {
            dictionary["activityId"] = activityId
        }

        if let href {
            dictionary["href"] = href
        }

        if let startedAt {
            dictionary["startedAt"] = startedAt
        }

        return dictionary
    }
}

struct MediaPlayerFrame: Codable {
    let x: CGFloat
    let y: CGFloat
    let width: CGFloat
    let height: CGFloat

    enum CodingKeys: String, CodingKey {
        case x, y, width, height
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        x = CGFloat(try container.decode(Double.self, forKey: .x))
        y = CGFloat(try container.decode(Double.self, forKey: .y))
        width = CGFloat(try container.decode(Double.self, forKey: .width))
        height = CGFloat(try container.decode(Double.self, forKey: .height))
    }

    init(x: CGFloat, y: CGFloat, width: CGFloat, height: CGFloat) {
        self.x = x
        self.y = y
        self.width = width
        self.height = height
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(Double(x), forKey: .x)
        try container.encode(Double(y), forKey: .y)
        try container.encode(Double(width), forKey: .width)
        try container.encode(Double(height), forKey: .height)
    }
}
