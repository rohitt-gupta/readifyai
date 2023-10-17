import { db } from "@/db";
import { openai } from "@/lib/openai";
// import { pinecone } from "@/lib/pinecone";
import { SendMessageValidator } from "@/lib/validators/SendMessageValidator";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { NextRequest } from "next/server";

import { OpenAIStream, StreamingTextResponse } from "ai";

import { Pinecone } from "@pinecone-database/pinecone";
import { VectorOperationsApi } from "@pinecone-database/pinecone/dist/v0/pinecone-generated-ts-fetch";

export const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
  environment: "asia-southeast1-gcp-free",
});


interface SearchResult {
  pageContent: string;
  metadata: {
    fileName: string;
  };
}

function customFilter(result: SearchResult, targetFileName: string): boolean {
  return result.metadata?.fileName === targetFileName;
}

export const runtime = "edge";

export const POST = async (req: NextRequest) => {
  const body = await req.json();

  const { getUser } = getKindeServerSession();
  const user = getUser();

  const { id: userId } = user;

  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { fileId, message } = SendMessageValidator.parse(body);

  const file = await db.file.findFirst({
    where: {
      id: fileId,
      userId,
    },
  });
  if (!file) return new Response("Not Found", { status: 404 });

  await db.message.create({
    data: {
      text: message,
      isUserMessage: true,
      userId,
      fileId,
    },
  });

  // vectorize the message

  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const list = await pinecone.listIndexes();
  const pineconeIndex = pinecone.index("aipdf")

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
  });

  // const results = await vectorStore.similaritySearch(message, 4);
  const results = await vectorStore.similaritySearch(message, 1, {
    filter: (result: SearchResult) => customFilter(result, file.id),
  });

  const prevMessages = await db.message.findMany({
    where: {
      fileId,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 6,
  });

  const formattedPrevMessages = prevMessages.map((msg) => ({
    role: msg.isUserMessage ? ("user" as const) : ("assistant" as const),
    content: msg.text,
  }));

  const response = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    temperature: 0,
    stream: true,
    messages: [
      {
        role: "system",
        content:
          "Use the following pieces of context (or previous conversaton if needed) to answer the users question in markdown format.",
      },
      {
        role: "user",
        content: `Use the following pieces of context (or previous conversaton if needed) to answer the users question in markdown format. \nIf you don't know the answer, just say that you don't know, don't try to make up an answer.
          
    \n----------------\n
    
    PREVIOUS CONVERSATION:
    ${formattedPrevMessages.map((message) => {
      if (message.role === "user") return `User: ${message.content}\n`;
      return `Assistant: ${message.content}\n`;
    })}
    
    \n----------------\n
    
    CONTEXT:
    ${results.map((r) => r.pageContent).join("\n\n")}
    
    USER INPUT: ${message}`,
      },
    ],
  });

  const stream = OpenAIStream(response, {
    async onCompletion(completion) {
      await db.message.create({
        data: {
          text: completion,
          isUserMessage: false,
          fileId,
          userId,
        },
      });
    },
  });

  return new StreamingTextResponse(stream);
};

// import { db } from '@/db'
// import { openai } from '@/lib/openai'
// import { getPineconeClient } from '@/lib/pinecone'
// import { SendMessageValidator } from '@/lib/validators/SendMessageValidator'
// import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
// import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
// import { PineconeStore } from 'langchain/vectorstores/pinecone'
// import { NextRequest } from 'next/server'

// import { OpenAIStream, StreamingTextResponse } from 'ai'

// export const POST = async (req: NextRequest) => {
//   // endpoint for asking a question to a pdf file

//   const body = await req.json()

//   const { getUser } = getKindeServerSession()
//   const user = getUser()

//   const { id: userId } = user

//   if (!userId)
//     return new Response('Unauthorized', { status: 401 })

//   const { fileId, message } =
//     SendMessageValidator.parse(body)

//   const file = await db.file.findFirst({
//     where: {
//       id: fileId,
//       userId,
//     },
//   })

//   if (!file)
//     return new Response('Not found', { status: 404 })

//   await db.message.create({
//     data: {
//       text: message,
//       isUserMessage: true,
//       userId,
//       fileId,
//     },
//   })

  // 1: vectorize message
  // const embeddings = new OpenAIEmbeddings({
  //   openAIApiKey: process.env.OPENAI_API_KEY,
  // })

  // const pinecone = await getPineconeClient()
  // const pineconeIndex = pinecone.Index('aipdf')

  // const vectorStore = await PineconeStore.fromExistingIndex(
  //   embeddings,
  //   {
  //     pineconeIndex,
  //     namespace: file.id,
  //   }
  // )

  // const results = await vectorStore.similaritySearch(
  //   message,
  //   4
  // )

//   const prevMessages = await db.message.findMany({
//     where: {
//       fileId,
//     },
//     orderBy: {
//       createdAt: 'asc',
//     },
//     take: 6,
//   })

//   const formattedPrevMessages = prevMessages.map((msg) => ({
//     role: msg.isUserMessage
//       ? ('user' as const)
//       : ('assistant' as const),
//     content: msg.text,
//   }))

//   const response = await openai.chat.completions.create({
//     model: 'gpt-3.5-turbo',
//     temperature: 0,
//     stream: true,
//     messages: [
//       {
//         role: 'system',
//         content:
//           'Use the following pieces of context (or previous conversaton if needed) to answer the users question in markdown format.',
//       },
//       {
//         role: 'user',
//         content: `Use the following pieces of context (or previous conversaton if needed) to answer the users question in markdown format. \nIf you don't know the answer, just say that you don't know, don't try to make up an answer.
        
//   \n----------------\n
  
//   PREVIOUS CONVERSATION:
//   ${formattedPrevMessages.map((message) => {
//           if (message.role === 'user')
//             return `User: ${message.content}\n`
//           return `Assistant: ${message.content}\n`
//         })}
  
//   \n----------------\n
  
//   CONTEXT:
//   ${results.map((r) => r.pageContent).join('\n\n')}
  
//   USER INPUT: ${message}`,
//       },
//     ],
//   })

//   const stream = OpenAIStream(response as any, {
//     async onCompletion(completion) {
//       await db.message.create({
//         data: {
//           text: completion,
//           isUserMessage: false,
//           fileId,
//           userId,
//         },

//       })
//     },
//   })

//   return new StreamingTextResponse(stream)
// }
