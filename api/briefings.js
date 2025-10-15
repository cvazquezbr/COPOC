import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { query } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'a-secure-default-secret-for-development';

export default async function handler(req, res) {
  try {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.auth_token;

    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    const userResult = await query('SELECT uuid FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const userUuid = userResult.rows[0].uuid;

    if (req.method === 'GET') {
      const { rows } = await query('SELECT * FROM briefings WHERE user_id = $1', [userUuid]);
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      // Corrigido para corresponder à estrutura do corpo da requisição do frontend
      const { nomeBriefing, briefing_data } = req.body;
      const name = nomeBriefing;

      // Extrai os campos do objeto aninhado briefing_data
      const { details, final_text, creation_mode, base_text, template, model_used, revised_text } = briefing_data;

      const { rows } = await query(
        // Remove as colunas 'company' e 'project' que não existem
        'INSERT INTO briefings (user_id, name, details, final_text, creation_mode, base_text, template, model_used, revised_text) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
        [userUuid, name, details, final_text, creation_mode, base_text, JSON.stringify(template), model_used, revised_text]
      );
      return res.status(201).json(rows[0]);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });

  } catch (error) {
    console.error('API /briefings error:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Authentication error' });
    }
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}