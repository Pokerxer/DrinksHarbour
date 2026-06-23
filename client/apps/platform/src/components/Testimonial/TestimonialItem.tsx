'use client';
import React from 'react';

interface TestimonialItemProps {
  name: string;
  rating: number;
  comment: string;
  date: string;
}

const TestimonialItem: React.FC<TestimonialItemProps> = ({ name, rating, comment, date }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center mb-4">
        <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center text-lg font-bold">
          {name.charAt(0)}
        </div>
        <div className="ml-4">
          <h4 className="font-semibold">{name}</h4>
          <p className="text-sm text-gray-500">{date}</p>
        </div>
      </div>
      <div className="text-yellow-400 mb-2">
        {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
      </div>
      <p className="text-gray-600">{comment}</p>
    </div>
  );
};

export default TestimonialItem;