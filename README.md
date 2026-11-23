# Vitiverse — Full-Stack Vitiligo Care, AI Companion & Skin Screening Platform

**Live Frontend:** https://dev11verma.github.io/vitiverse/  
**Live Backend API:** https://vitiverse.onrender.com  
**Health Check:** https://vitiverse.onrender.com/api/health  

## Architecture
- **Frontend:** Responsive single-page web application hosted on GitHub Pages (index.html).
- **Backend:** Node.js + Express REST API deployed on Render (server.js).
- **Database:** MongoDB Atlas (itiverse cluster) with automatic local JSON fallback.
- **AI & Vision:**
  - **VitiBuddy (/api/chat):** Open-ended multilingual AI companion (English, Hindi, Hinglish, Punjabi, etc.) with dynamic Gemini/Gemma model discovery.
  - **Skin Patch Screening (/api/analyze-patch):** Multimodal Gemini Vision image analysis with automatic Skin Diary logging.

## Team Setup (Local Development)
1. Clone the repository and run 
pm install.
2. Create a .env file (never commit .env) with:
   - GEMINI_API_KEY=your_gemini_api_key
   - MONGODB_URI=your_mongodb_atlas_uri
3. Start the server with 
ode server.js.