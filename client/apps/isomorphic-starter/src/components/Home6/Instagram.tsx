'use client';

interface InstagramProps {
  className?: string;
}

const Instagram: React.FC<InstagramProps> = ({ className = '' }) => {
  return (
    <div className={className}>
      <div className="container mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-center">Instagram</h2>
        <p className="text-center text-gray-600 mt-2">Follow us on Instagram</p>
      </div>
    </div>
  );
};

export default Instagram;