'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';

export default function CareersPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const jobs = [
    {
      title: 'Customer Service Representative',
      department: 'Operations',
      location: 'Abuja, Nigeria',
      type: 'Full-time',
      description: 'Handle customer inquiries and provide excellent support'
    },
    {
      title: 'Delivery Driver',
      department: 'Logistics',
      location: 'Abuja, Nigeria',
      type: 'Full-time',
      description: 'Deliver orders safely and on time'
    },
    {
      title: 'Marketing Manager',
      department: 'Marketing',
      location: 'Abuja, Nigeria',
      type: 'Full-time',
      description: 'Lead marketing campaigns and brand initiatives'
    },
    {
      title: 'Warehouse Associate',
      department: 'Operations',
      location: 'Abuja, Nigeria',
      type: 'Full-time',
      description: 'Manage inventory and order fulfillment'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900">Careers at DrinksHarbour</h1>
          <p className="mt-2 text-gray-600">Join our growing team</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Why Work With Us</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <Icon.PiHeartBold className="w-6 h-6 text-pink-500 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-gray-900">Great Culture</h3>
                <p className="text-sm text-gray-600">Work in a supportive environment</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Icon.PiChartLineUpBold className="w-6 h-6 text-green-500 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-gray-900">Growth Opportunities</h3>
                <p className="text-sm text-gray-600">Career development programs</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Icon.PiGiftBold className="w-6 h-6 text-purple-500 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-gray-900">Competitive Benefits</h3>
                <p className="text-sm text-gray-600">Health, dental, and more</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Icon.PiClockBold className="w-6 h-6 text-blue-500 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-gray-900">Flexible Hours</h3>
                <p className="text-sm text-gray-600">Work-life balance</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Open Positions</h2>
          {jobs.length > 0 ? (
            <div className="space-y-4">
              {jobs.map((job, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900">{job.title}</h3>
                      <p className="text-sm text-gray-600">{job.department} • {job.location} • {job.type}</p>
                      <p className="text-sm text-gray-500 mt-1">{job.description}</p>
                    </div>
                    <button className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors">
                      Apply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">No open positions at the moment.</p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Don't see the right role?</h2>
          <p className="text-gray-600 mb-6">Send us your resume and we'll reach out when a suitable position opens up.</p>
          
          {submitted ? (
            <div className="bg-green-50 text-green-800 p-4 rounded-lg">
              Thank you! We'll be in touch soon.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-4">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
              <button type="submit" className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
                Submit
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}