import { NewsletterEngine } from '@/components/NewsletterEngine';

function App() {
  return (
    <main style={{ padding: '2rem', maxWidth: 960, margin: '0 auto' }}>
      <h1>Deputy Mayor 2.0</h1>
      <p style={{ color: '#555', marginBottom: '1.5rem' }}>
        Local-first, date-aware municipal assistant
      </p>
      <NewsletterEngine />
    </main>
  );
}

export default App;
