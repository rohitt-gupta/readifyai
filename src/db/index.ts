// // import { PrismaClient } from '@prisma/client'
// // import { withAccelerate } from '@prisma/extension-accelerate'
// import { PrismaClient } from '@prisma/client/edge'

// declare global {
//   // eslint-disable-next-line no-var
//   var cachedPrisma: PrismaClient
// }

// let prisma: PrismaClient
// if (process.env.NODE_ENV === 'production') {
//   prisma = new PrismaClient()
// } else {
//   if (!global.cachedPrisma) {
//     global.cachedPrisma = new PrismaClient()
//   }
//   prisma = global.cachedPrisma
// }

// export const db = prisma

import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";

const prisma = new PrismaClient().$extends(withAccelerate());

export const db = prisma;
