# Habit & Health Tracker

An installable Android-friendly habit tracking Progressive Web App.

## Run locally

From this folder:

```sh
python -m http.server 8080
```

Open `http://127.0.0.1:8080` in a browser. On Android Chrome, open the browser menu and choose **Add to Home screen** or **Install app**.

## Features

- Add color-coded daily habits
- Mark habits complete for today
- See done-today count, active habits, and best streak
- View the last seven days for each habit
- Works offline after the first load
- Saves data on the device with `localStorage`
