'use client';

import React from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';

export default function FAQPage() {
  const faqs = [
    {
      question: 'How do I create an account?',
      answer: 'Click on the "Sign Up" button at the top right of the page. Fill in your email address and create a password. You can also sign up using your Google account.'
    },
    {
      question: 'How can I track my order?',
      answer: 'Once your order is shipped, you will receive a tracking number via SMS and email. You can also log in to your account and view the tracking information under "My Orders".'
    },
    {
      question: 'What is your return policy?',
      answer: 'We accept returns within 7 days of delivery for unopened items in original packaging. For damaged or incorrect items, please contact our support team immediately.'
    },
    {
      question: 'How do I reset my password?',
      answer: 'Click on "Forgot Password" on the login page. Enter your email address and we will send you instructions to reset your password.'
    },
    {
      question: 'Do you deliver to my area?',
      answer: 'We deliver to major cities across Nigeria. Enter your address at checkout to confirm if we deliver to your location.'
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept cash on delivery, credit/debit cards, and bank transfers. Card payments are processed securely through our payment partners.'
    },
    {
      question: 'Is there a minimum order amount?',
      answer: 'No, there is no minimum order amount. However, free standard delivery is available for orders over ₦50,000.'
    },
    {
      question: 'How do I contact customer support?',
      answer: 'You can reach us via email at support@drinksharbour.com, through the contact form on our website, or call our customer service line.'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900">Frequently Asked Questions</h1>
          <p className="mt-2 text-gray-600">Find answers to common questions</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-start gap-3">
                <Icon.PiQuestionBold className="w-5 h-5 mt-1 flex-shrink-0 text-gray-600" />
                {faq.question}
              </h3>
              <p className="mt-3 text-gray-600 pl-8">{faq.answer}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-600 mb-4">Still have questions?</p>
          <Link href="/contact" className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
            Contact Us
            <Icon.PiArrowRightBold />
          </Link>
        </div>
      </div>
    </div>
  );
}