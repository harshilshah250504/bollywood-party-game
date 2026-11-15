# Bollywood Party Game

A host-led Bollywood movie and music quiz for two teams. The game includes six rounds and 96 questions, with timers, scoring, answer reveals and embedded clips.

## Play locally

From this folder, run `python3 -m http.server 8000` and open `http://localhost:8000`. An internet connection is required for YouTube playback. Some YouTube videos may be restricted on localhost.

## Publish the website

Upload the files in this folder to the root of a GitHub repository.

- **GitHub Pages**. In the repository settings, choose **Pages**, then **Deploy from a branch**. Select **main** and **/(root)**.
- **Vercel**. Import the GitHub repository as a new project. Choose **Other** as the framework preset and deploy from the repository root. There is no build step.

The welcome song uses an Apple Music preview. Round clips stream from YouTube.
