/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
    async fetch(request) {
      console.log("hello")
      const url = new URL(request.url);
      const skillName = url.pathname.split("/").filter(Boolean).pop();
      console.log("SkillName:", skillName)
      const githubRaw = `https://raw.githubusercontent.com/1Shot-API/skills/refs/heads/main/1shot-api/${skillName}`;
      
      const response = await fetch(githubRaw);
      
      if (!response.ok) {
        return new Response("Not found", { status: 404 });
      }
      
      return new Response(response.body, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }
  }