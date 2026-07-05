import SwiftUI
import SafariServices

struct ContentView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "keyboard")
                .font(.system(size: 48))
                .foregroundColor(.accentColor)

            Text("Vimfari")
                .font(.largeTitle)
                .fontWeight(.bold)

            Text("The Hacker's Browser for Safari")
                .font(.subheadline)
                .foregroundColor(.secondary)

            Text("Vim-style keyboard shortcuts for navigation and control")
                .font(.body)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Divider()
                .padding(.horizontal, 40)

            VStack(alignment: .leading, spacing: 8) {
                Text("To enable Vimfari:")
                    .fontWeight(.semibold)

                HStack {
                    Text("1.")
                    Text("Open Safari → Preferences (⌘,)")
                }
                HStack {
                    Text("2.")
                    Text("Go to the Extensions tab")
                }
                HStack {
                    Text("3.")
                    Text("Enable the checkbox next to Vimfari")
                }
                HStack {
                    Text("4.")
                    Text("Click \"Always Allow on Every Website…\"")
                }
            }
            .font(.body)
            .padding(.horizontal)

            Spacer()

            Text("Vimfari is a port of Vimium for Safari")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .frame(minWidth: 400, minHeight: 350)
    }
}

#Preview {
    ContentView()
}
