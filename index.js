const express = require('express');
const moment = require('moment');
const fs = require('fs');

const app = express();
app.use(express.static(__dirname));
app.use(express.urlencoded({ extended: true }));

// Read links from links.json file
app.get('/', async (req, res) => {
  try {
    fs.readFile('links.json', 'utf8', (err, data) => {
      if (err) {
        console.error(err);
        return res.send('Error reading links file');
      }
      // Parse JSON data
      const jsonData = JSON.parse(data);
      // Create list of links, get favicon from google
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
      }
    // Delete link function
    app.post('/delete-link', (req, res) => {
      try {
        // Read existing links from links.json file
        const jsonData = JSON.parse(fs.readFileSync('links.json', 'utf8'));
        const { name } = req.body;
        delete jsonData[name];
        fs.writeFileSync('links.json', JSON.stringify(jsonData, null, 2));
        // write deleted link to deleted.json
        fs.appendFileSync('deleted.json', JSON.stringify(jsonData, null, 2));

        res.redirect('/');
      } catch (error) {
        console.error(error);
        res.send('Error deleting link');
      }
    });
    app.post('/add-link', (req, res) => {
      try {
        // Read existing links from links.json file
        const jsonData = JSON.parse(fs.readFileSync('links.json', 'utf8'));
        // Add new link to jsonData object using form data
          const { name, link } = req.body;
          jsonData[name] = link;
          // Write updated jsonData object back to links.json file
          fs.writeFileSync('links.json', JSON.stringify(jsonData, null, 2));
          // Redirect to home page after adding link
          res.redirect('/');
        } catch (error) {
          console.error(error);
          res.send('Error adding link');
        }
    });
    // Create HTML page
    // Display today's date and greeting
      const today = moment().format('ddd, MMM D');
      const msg = `Hello YOU today is ${today}.`;
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
          </body>
        </html>
      `;
      res.send(html);
    });
  } catch (error) {
    console.error(error);
    res.send('Error getting links');
  }
});

app.listen(80, '0.0.0.0', () => {
  console.log('Server listening on port 80');
});