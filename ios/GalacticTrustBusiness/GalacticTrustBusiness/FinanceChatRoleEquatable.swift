import Foundation

extension FinanceChatMessage.Role: Equatable {
    static func == (lhs: FinanceChatMessage.Role, rhs: FinanceChatMessage.Role) -> Bool {
        switch (lhs, rhs) {
        case (.user, .user), (.assistant, .assistant):
            true
        default:
            false
        }
    }
}
