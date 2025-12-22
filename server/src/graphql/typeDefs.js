// Define GraphQL schema (SDL) for Users, Videos, Transcripts, Voiceovers, Documentation, and Queries/Mutations

const { gql } = require('apollo-server-express');

const typeDefs = gql`
  scalar Date

  type User {
    id: ID!
    email: String!
    name: String
    created_at: Date
    updated_at: Date
  }

  type Transcript {
    id: ID!
    original_transcript: String
    improved_script: String
    language: String
    created_at: Date
  }

  type Voiceover {
    id: ID!
    audio_path: String
    voice_type: String
    script_text: String
    created_at: Date
  }

  type Documentation {
    id: ID!
    content: String
    format: String
    created_at: Date
  }

  type Video {
    id: ID!
    user_id: ID!
    title: String
    description: String
    video_path: String
    thumbnail_path: String
    duration: Int
    status: String
    created_at: Date
    transcript: Transcript
    voiceover: Voiceover
    documentation: Documentation
  }

  type VideoList {
    videos: [Video!]!
    total: Int!
    page: Int!
    pages: Int!
  }

  type ShareLink {
    id: ID!
    token: String!
    video_id: ID!
    expires_at: Date
    view_count: Int!
    created_at: Date
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  input VideoUpdateInput {
    title: String
    description: String
  }

  type Query {
    me: User
    videos(page: Int = 1, limit: Int = 10, status: String): VideoList!
    video(id: ID!): Video
    shared(token: String!): Video
  }

  type Mutation {
    register(email: String!, password: String!, name: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    uploadVideo(title: String, description: String, filePath: String!): Video!
    updateVideo(id: ID!, input: VideoUpdateInput!): Video!
    deleteVideo(id: ID!): Boolean!
    createShareLink(videoId: ID!, expiresInHours: Int): ShareLink!
    transcribe(videoId: ID!): Transcript!
    improveScript(videoId: ID!): Transcript!
    generateVoice(videoId: ID!, voice: String): Voiceover!
    generateDocs(videoId: ID!): Documentation!
  }
`;

module.exports = typeDefs;