const express = require('express');
const cors = require('cors');
const { expressjwt: jwt } = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const envVariables = require('./env-variables.json');
const stripeSecretKey = envVariables.stripeSecretKey || process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('Missing Stripe secret key.');
}
const stripe = require('stripe')(stripeSecretKey);


const app = express();

// Configure CORS to allow https://localhost:5173
app.use(cors({
  origin: ['https://localhost:5173', 'http://localhost:5173', 'http://localhost:5174'],
}));

app.get('/public', (req, res) => res.send('This is a public endpoint accessible to everyone.'));

app.get('/auth/success', (req, res) => {
  // Redirect zur App mit Custom Scheme
  res.redirect("finanz-navigator://auth/success");
});

app.use(jwt({
  // Dynamically provide a signing key based on the kid in the header and the singing keys provided by the JWKS endpoint.
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${envVariables.auth0Domain}/.well-known/jwks.json`
  }),

  // Validate the audience and the issuer.
  audience: envVariables.apiIdentifier,
  issuer: `https://${envVariables.auth0Domain}/`,
  algorithms: ['RS256']
}));

app.get('/private', (req, res) => res.send('Only authenticated users can read this message.'));

app.post('/stripe', async (req, res) => {

  try {

    const stripeCustomerId = req.auth['http://localhost:3000/stripe_customer_id'];

    const session = await stripe.checkout.sessions.create({
      success_url: "https://api.fina4you.de/auth/success",
      cancel_url: "https://api.fina4you.de/auth/success",
      payment_method_types: ["card"],
      customer: stripeCustomerId,
      line_items: [
        {
          price: "price_1SB7pMDMCN5y7etQMEiR5qO8",
          quantity: 1,
        },
      ],
      mode: "subscription",
    });

    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err.message || "Internal Server Error" });
  }
});

app.get('/subscription-status', async (req, res) => {
  const customerId = req.auth['http://localhost:3000/stripe_customer_id'];
  const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', expand: ['data.latest_invoice.payment_intent'] });
  const active = subscriptions.data.some(sub => sub.status === 'active' || sub.status === 'trialing');
  res.json({ active });
});

app.listen(3000, () => console.log('Example app listening on port 3000!'));
