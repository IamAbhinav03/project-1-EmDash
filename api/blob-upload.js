import { handleUpload } from '@vercel/blob/client'

export async function POST(request) {
  try {
    const result = await handleUpload({
      body: await request.json(),
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/flac', 'audio/aac', 'audio/webm'],
        maximumSizeInBytes: 250 * 1024 * 1024,
        addRandomSuffix: true,
      }),
    })
    return Response.json(result)
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 })
  }
}
