// Estado partilhado entre endpoints (em memória - funciona no Vercel durante a sessão)
export const readMap = new Map();   // id -> { status:'read', readAt }
export const metaMap = new Map();   // id -> { to, subject, createdAt }