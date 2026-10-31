# Analytics Toolkit

Small, open-source browser tools for the everyday work of analysts and data scientists.

**Live:** https://renarion.github.io/analytics-toolkit/

## Why

A lot of analytics work is not SQL or models. It's planning a quarter, showing a roadmap to stakeholders and keeping track of the week. The usual tools for that are either heavy (Jira, Notion, slide decks) or ask you to sign up and upload your data.

This toolkit is the opposite: a few focused pages that open instantly, need no account and keep everything in your browser. Nothing is sent to a server.

## Tools

### Roadmap

Turn a list of tasks into a clean Gantt chart.

- Group tasks by category, pick date ranges in a calendar, colour individual bars.
- Task names are never cut: they wrap inside the bar, and the bar grows taller to fit.
- Weeks on the time axis start on Monday.
- Zoom in and out, or fit the whole chart to the screen.
- Export to SVG or PNG, copy the chart as Mermaid code, or import an existing Mermaid gantt.

### Weekly planner

A board for the current week that you can keep open in a tab all day.

- Monday to Friday by default; add Saturday and Sunday with `+` when you need them.
- Press `+ Add task` and type, press Enter to add the next one. Tick tasks off with checkboxes.
- Mark a task as critical with the fire icon: it jumps to the top of the day and turns red.
- Week progress at the top, plus a backlog and notes below the days.
- Copy everything as Markdown or delete all tasks in one click.
- Autosaves to your browser's local storage and stays there until you delete it.

### List formatter

Paste values and get a list ready for a filter: `123 1213 1244` → `'123', '1213', '1244'`.

- Values can be separated by spaces, tabs, new lines, commas or semicolons, so a column copied from Excel, Google Sheets or Redash works as is.
- Choose quotes: none, single or double, with proper escaping.
- Optionally wrap the list in `( )` for SQL `IN` or `[ ]` for a Python list, and remove duplicates.
- Split by lines only when values contain spaces, e.g. city names.

## Contributing

The project is plain HTML, CSS and JavaScript: no framework, no build step. Open `index.html` in a browser, or serve the folder with any static server.

- **Ideas and bugs:** open an [issue](https://github.com/Renarion/analytics-toolkit/issues). New tools for analysts and data scientists are welcome. Describe the problem you solve every week, and we'll see if a tool fits.
- **Pull requests:** small, focused PRs are easiest to review. Every page should keep working offline-first and must not send user data anywhere.
- **Design:** all pages share one design system in `css/base.css` (colours, type, buttons, fields). Reuse its tokens and components instead of adding new ones, so new tools look like part of the same kit.

Project layout:

```
index.html        Home page           → css/home.css
roadmap.html      Roadmap tool        → js/roadmap.js, css/roadmap.css
planner.html      Weekly planner      → js/planner.js, css/planner.css
list.html         List formatter      → js/list.js, css/list.css
css/base.css      Shared design system
```

## License

[MIT](LICENSE)
