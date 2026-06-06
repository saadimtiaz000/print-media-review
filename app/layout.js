import "../styles.css";

export const metadata = {
  title: "Pakistan Print Media Review",
  description: "Daily print media review for Pakistan newspapers"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
