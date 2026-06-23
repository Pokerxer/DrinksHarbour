'use client';

interface NewsletterProps {
  className?: string;
}

const Newsletter: React.FC<NewsletterProps> = ({ className = '' }) => {
  return (
    <div className={className}>
      <div className="container mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-center">Newsletter</h2>
        <p className="text-center text-gray-600 mt-2">Subscribe to our newsletter for updates</p>
      </div>
    </div>
  );
};

export default Newsletter;