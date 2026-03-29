import type { NextApiRequest, NextApiResponse } from 'next'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state } = req.query
  if (!code || !state) return res.status(400).json({ error: 'Missing code or state' })

  try {
    const r = await fetch(`${API}/agents/google/callback?code=${code}&state=${state}`)
    const data = await r.json()
    if (data.success) {
      // Close popup and notify parent
      res.setHeader('Content-Type', 'text/html')
      res.send(`
        <html><body>
          <script>
            window.opener?.postMessage({ type: 'google_connected', agentId: '${state}' }, '*');
            window.close();
          </script>
          <p>Google Calendar connected! You can close this window.</p>
        </body></html>
      `)
    } else {
      res.status(400).json({ error: 'OAuth failed' })
    }
  } catch (e) {
    res.status(500).json({ error: 'OAuth error' })
  }
}