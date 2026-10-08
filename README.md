# World Charts

What's #1 in every country, on a 3D globe: movies and TV (Netflix Top 10), music (Apple Music), and food and games (Google Trends).

```bash
npm install
npm run dev
```

Refresh data:

```bash
python pipeline/netflix.py
python pipeline/apple_music.py
pip install -r pipeline/requirements.txt
python pipeline/trends.py
```
