import "./globals.css";
import TabBar from "@/components/TabBar";
import Notifier from "@/components/Notifier";

export const metadata = {
  title: "PapaStocks",
  description: "A friendly stock companion for Papa — live prices, smart picks and an AI buddy.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "PapaStocks",
    statusBarStyle: "black-translucent"
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png"
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#161618"
};

/* Applies saved theme before first paint to avoid a flash. */
const themeScript = `
try {
  var p = JSON.parse(localStorage.getItem("ps_prefs") || "{}");
  document.documentElement.dataset.theme = p.theme || "manus";
  document.documentElement.dataset.bigtext = p.bigText ? "1" : "0";
} catch (e) {}
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="manus" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Notifier />
        <main className="shell">{children}</main>
        <TabBar />
      </body>
    </html>
  );
}
