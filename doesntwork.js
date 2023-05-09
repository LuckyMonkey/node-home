const express = require('express');
const cookieParser = require('cookie-parser');
const moment = require('moment');
const fs = require('fs');

const app = express();
app.use(express.static(__dirname));
app.use(express.urlencoded({ extended: true }));

app.get('/', async (req, res) => {
  try {
    fs.readFile('links.json', 'utf8', (err, data) => {
      if (err) {
        console.error(err);
        return res.send('Error reading links file');
      }
      // Parse JSON data
      // Build li list of links from JSON data using map function and template
      // include delete button and favicon from google
      // change the www. and make a function to handle the urls from JSON

      // change the name of the function to createList and create list types
      // create a function to handle the different types of lists
      // the links list and the deleted list, and the add link form
      // add a function for todo list items
      // add a json file for todo list items
      // add a function for the add to list form that can be used for both lists
      const jsonData = JSON.parse(data);
      function createList(jsonData) {
        const listItems = Object.entries(jsonData).map(([name, link]) => `
          <li>
            <a href="http://www.${link}">
              <form method="POST" action="/delete-link">
                <input type="hidden" name="name" value="${name}">
                <button title="Delete?"  type="submit">-</button>
              </form>
              <img src="https://www.google.com/s2/favicons?domain=${link}" alt="fav" />
              <h3>${name}</h3>
            </a>
          </li>
        `);

        // Add link form function
        listItems.push(`
          <li>
            <form method="POST" action="/add-link">
              <input type="text" name="name" placeholder="Name">
              <input type="text" name="link" placeholder="URL">
              <button type="submit">Add Link</button>
            </form>
          </li>
        `);
        return `<ul>${listItems.join('')}</ul>`;
      };
      
      // Delete link function
      app.post('/delete-link', (req, res) => {
        try {
          const jsonData = JSON.parse(fs.readFileSync('links.json', 'utf8'));
          const { name } = req.body;
          delete jsonData[name];
          fs.writeFileSync('links.json', JSON.stringify(jsonData, null, 2));
          fs.appendFileSync('deleted.json', JSON.stringify(jsonData, null, 2));
          res.redirect('/');
        } catch (error) {
          console.error(error);
          res.send('Error deleting link');
        }
      });

      // Add link function
      app.post('/add-link', (req, res) => {
        try {
          const jsonData = JSON.parse(fs.readFileSync('links.json', 'utf8'));
          const { name, link } = req.body;
          jsonData[name] = link;
          fs.writeFileSync('links.json', JSON.stringify(jsonData, null, 2));
          res.redirect('/');
        } catch (error) {
          console.error(error);
          res.send('Error adding link');
        }
      });

      // Set viewer function
      function setViewer(req) {
        const viewer = req.cookies.viewer || 'viewer';
        const html = `
          <form method="POST" action="/set-viewer">
            <input type="text" name="viewer" placeholder="Your Name" value="${viewer}">
            <button type="submit">Change Name</button>
          </form>
        `;
        return html;
      };

      const viewer = req.cookies.viewer || 'viewer';
      const today = moment().format('ddd, MMM D');
      const msg = `Hello ${viewer} today is ${today}.`;
      const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>fucking homepage</title>
          <link rel="stylesheet" href="d.css">
        </head>
        <body>
          <h1>${msg}</h1>
          ${createList(jsonData)}
          <div>${setViewer(req)};</div>
        </body>
      </html>
      `;
      res.send(html);
  );

} catch (error) {
  console.error(error);
  res.send('Error getting links');
}

// Start the server
app.listen(80, '0.0.0.0', () => {
  console.log('Server listening on port 80');
});
