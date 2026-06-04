import './globals.css'

export const metadata = {
  title: 'Meraki Ads — Meta Dashboard',
  description: 'Live Meta Ads Intelligence Dashboard for Meraki Ads',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500;700&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
