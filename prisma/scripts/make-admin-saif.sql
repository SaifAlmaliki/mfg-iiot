-- Grant Administrator role to saif.wsm@gmail.com
-- Run against your database (e.g. psql, or Prisma Studio SQL, or Neon SQL editor)

-- Add ADMIN role to the user if not already assigned
INSERT INTO user_roles (id, "userId", "roleId")
SELECT
  gen_random_uuid()::text,
  u.id,
  r.id
FROM users u
CROSS JOIN roles r
WHERE u.email = 'saif.wsm@gmail.com'
  AND r.code = 'ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur."userId" = u.id AND ur."roleId" = r.id
  );

-- Optional: remove other roles so the user has only ADMIN (uncomment if needed)
-- DELETE FROM user_roles
-- WHERE "userId" = (SELECT id FROM users WHERE email = 'saif.wsm@gmail.com')
--   AND "roleId" != (SELECT id FROM roles WHERE code = 'ADMIN');
