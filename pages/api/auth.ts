import type { NextApiRequest, NextApiResponse } from 'next'
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { user, pass } = req.body
  if (user === (process.env.NEXT_PUBLIC_ADMIN_USER || 'admin') &&
      pass === (process.env.ADMIN_PASSWORD        || 'cosmic2025')) {
    return res.status(200).json({ ok: true })
  }
  return res.status(401).json({ ok: false })
}