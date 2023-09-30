import { db } from "@/db";
import { SendMessageValidator } from "@/lib/validators/SendMessageValidator";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { NextRequest } from "next/server";

export const POST = async (req: NextRequest) => {
  // endpoint for asking a question to pdf

  const body = await req.json();

  const { getUser } = getKindeServerSession();
  const user = getUser();
  const { id: userId } = user

  if (!userId) {
    return new Response('Unauthorized',
      { status: 401 })
  }

  //heck using zod validator
  const { fileId, message } = SendMessageValidator.parse(body);

  // find file in db with the fileID received
  const file = await db.file.findFirst({
    where: {
      id: fileId,
      userId,
    }
  })

  // if no fils found
  if (!file) {
    return new Response('Not found',
      { status: 404 })
  }

  await db.message.create({
    data: {
      text: message,
      isUserMessage: true,
      userId,
      fileId
    }
  })

  // AI PART.


}