'use client';
import React from 'react';

interface PaymentHandlerProps {
  clientSecret?: any;
  amount?: number;
  onPaymentSuccess?: (data: any) => Promise<void>;
  onPaymentError?: (error: string) => void;
  [key: string]: any;
}

const PaymentHandler: React.FC<PaymentHandlerProps> = (props) => {
  return null;
};

export default PaymentHandler;
