# Admin Login Credentials

## Henry Admin Account

**Email:** henry@admin.com  
**Password:** admin123

## Setup Instructions

1. Your `.env.local` file should already include NeonDB variables (created by Vercel CLI when connecting NeonDB):
   - `DATABASE_URL` - PostgreSQL connection string
   - `STACK_SECRET_SERVER_KEY` - Used automatically as `AUTH_SECRET` for NextAuth
   - Other NeonDB/Stack Auth variables are automatically included

   **Note:** The `AUTH_SECRET` for NextAuth will automatically use `STACK_SECRET_SERVER_KEY` from your NeonDB Stack Auth setup. No additional configuration needed!

2. Run database migrations:
   ```bash
   pnpm db:push
   ```

3. Seed the database (this will create the henry admin user):
   ```bash
   pnpm db:seed
   ```

4. Start the development server:
   ```bash
   pnpm dev
   ```

5. Navigate to `/login` and use the credentials above to access the admin panel.

## Security Notes

- The password is encrypted using bcrypt with 10 salt rounds
- Only users with `type: ADMIN` can access the admin panel
- The admin panel is protected by NextAuth.js session authentication
- Passwords are never stored in plain text
- All environment variables are already in `.gitignore` to prevent accidental commits

