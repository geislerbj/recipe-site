const https = require('https');

const SUPABASE_URL  = 'https://fgpbxrkaedktiffwteub.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZncGJ4cmthZWRrdGlmZnd0ZXViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzAwNzksImV4cCI6MjA5NDQ0NjA3OX0.UmR3AUvCVSD6bb6HzZtDhS6o-tlASb2LFibXvY1A6bY';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let recipe;
  try {
    recipe = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  // Validate required field
  if (!recipe.name) {
    return { statusCode: 400, body: JSON.stringify({ error: 'name is required' }) };
  }

  const payload = JSON.stringify({
    name:        recipe.name,
    description: recipe.description || null,
    servings:    recipe.servings    || null,
    tags:        recipe.tags        || [],
    ingredients: recipe.ingredients || [],
    steps:       recipe.steps       || [],
  });

  return new Promise((resolve) => {
    const req = https.request(
      `${SUPABASE_URL}/rest/v1/recipes`,
      {
        method: 'POST',
        headers: {
          'apikey':       SUPABASE_ANON,
          'Authorization': `Bearer ${SUPABASE_ANON}`,
          'Content-Type': 'application/json',
          'Prefer':       'return=representation',
        },
      },
      (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              statusCode: 200,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ success: true, data: JSON.parse(body) }),
            });
          } else {
            resolve({
              statusCode: res.statusCode,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ error: body }),
            });
          }
        });
      }
    );
    req.on('error', (e) => {
      resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) });
    });
    req.write(payload);
    req.end();
  });
};
