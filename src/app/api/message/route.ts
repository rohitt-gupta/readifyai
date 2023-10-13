import { db } from '@/db'
import { openai } from '@/lib/openai'
import { SendMessageValidator } from '@/lib/validators/SendMessageValidator'
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { PineconeStore } from 'langchain/vectorstores/pinecone'
import { NextRequest } from 'next/server'
import { OpenAIStream, StreamingTextResponse } from 'ai'
// import { pinecone } from '@/lib/pinecone'
import { getEncoding } from "js-tiktoken";
import { getPineconeClient } from '@/lib/pinecone'

const encoding = getEncoding("cl100k_base");
const interval = 400

interface Message {
  role: 'user' | 'assistant';
  content: string;
}


export const POST = async (req: NextRequest) => {
  // endpoint for asking a question to a pdf file

  const body = await req.json()

  const { getUser } = getKindeServerSession()
  const user = getUser()

  const { id: userId } = user

  if (!userId)
    return new Response('Unauthorized', { status: 401 })

  const { fileId, message } = SendMessageValidator.parse(body)

  const file = await db.file.findFirst({
    where: {
      id: fileId,
      userId,
    },
  })

  if (!file)
    return new Response('Not found', { status: 404 })

  await db.message.create({
    data: {
      text: message,
      isUserMessage: true,
      userId,
      fileId,
    },
  })

  const dbUser = await db.user.findFirst({
    where: {
      id: userId
    }
  })
  if (!dbUser) return new Response('Unauthorizied', { status: 403 })

  // const lang = dbUser.language
  // const language = lang === 'gb' ? 'english' : 'german'



  // 1: Vectorize message
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
  })

  // const pineconeIndex = pinecone.Index('examify')
  //   const vectorStore = await PineconeStore.fromExistingIndex(
  //     embeddings,
  //     {
  //       pineconeIndex,
  //       namespace: file.id,
  //     }
  //   )

  const pinecone = await getPineconeClient()
    const pineconeIndex = pinecone.Index('aipdf')

  const vectorStore = await PineconeStore.fromExistingIndex(
    embeddings,
    {
      pineconeIndex,
      namespace: file.id,
    }
  )

  const results = await vectorStore.similaritySearch(
    message,
    4
  )

  const prevMessages = await db.message.findMany({
    where: {
      fileId,
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: 3,
  })

  const formattedPrevMessages = prevMessages.map((msg) => ({
    role: msg.isUserMessage
      ? ('user' as const)
      : ('assistant' as const),
    content: msg.text,
  }))

  // Count tokens in the conversation
  const conversationTokens = countTokensInConversation(
    formattedPrevMessages,
    results,
    message
  );

  // Choose the appropriate GPT model based on token count
  const modelToUse = conversationTokens < 4096 - interval ? 'gpt-3.5-turbo' : 'gpt-3.5-turbo-16k';

  const response = await openai.chat.completions.create({
    model: modelToUse,
    temperature: 0,
    stream: true,
    messages: [
      {
        role: 'system',
        content:
          `Please only ANSWER IN THIS LANGUAGE: English. Never answer in a different language. Only use English
          Use the following pieces of context (or previous conversation if needed) to answer the user\'s question in markdown format. Try not to answer in really long paragraphs! Only if the user asks you to describe more detailed.`,
      },
      {
        role: 'user',
        content: `Use the following pieces of context (or previous conversation if needed) to answer the user's question in markdown format. \nIf you don't know the answer, just say that you don't know, don't try to make up an answer.
        
  \n----------------\n
  
  PREVIOUS CONVERSATION:
  ${formattedPrevMessages.map((message) => {
          if (message.role === 'user')
            return `User: ${message.content}\n`
          return `Assistant: ${message.content}\n`
        })}
  
  \n----------------\n
  
  CONTEXT:
  ${results.map((r) => r.pageContent).join('\n\n')}
  
  USER INPUT: ${message}`,
      },
    ],
  })

  const stream = OpenAIStream(response, {
    async onCompletion(completion) {
      await db.message.create({
        data: {
          text: completion,
          isUserMessage: false,
          fileId,
          userId,
        },
      })
    },
  })

  return new StreamingTextResponse(stream)
}

/// Helper function to count tokens in a conversation
function countTokensInConversation(prevMessages: Message[], results: any[], message: string) {
  const conversationText = `
    Use the following pieces of context (or previous conversation if needed) to answer the user's question in markdown format. \nIf you don't know the answer, just say that you don't know, don't try to make up an answer.
    
    \n----------------\n
    
    PREVIOUS CONVERSATION:
    ${prevMessages.map((message) => {
    if (message.role === 'user')
      return `User: ${message.content}\n`;
    return `Assistant: ${message.content}\n`;
  })}
    
    \n----------------\n
    
    CONTEXT:
    ${results.map((r) => r.pageContent).join('\n\n')}
    
    USER INPUT: ${message}
  `;

  const tokens = encoding.encode(conversationText);
  const tokenCount = tokens.length;
  return tokenCount
}


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

//   // 1: vectorize message
//   const embeddings = new OpenAIEmbeddings({
//     openAIApiKey: process.env.OPENAI_API_KEY,
//   })

//   const pinecone = await getPineconeClient()
//   const pineconeIndex = pinecone.Index('aipdf')

//   const vectorStore = await PineconeStore.fromExistingIndex(
//     embeddings,
//     {
//       pineconeIndex,
//       namespace: file.id,
//     }
//   )

//   const results = await vectorStore.similaritySearch(
//     message,
//     4
//   )

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
