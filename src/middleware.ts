import { authMiddleware } from "@kinde-oss/kinde-auth-nextjs/server"

export const cofig = {
  matcher: ["/dashboard/:path*", "auth-callback"]
}

export default authMiddleware