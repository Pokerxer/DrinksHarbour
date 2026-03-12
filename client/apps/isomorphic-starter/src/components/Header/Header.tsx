'use client';

import React from 'react';

interface HeaderProps {
  variant?: string;
  showAnnouncement?: boolean;
  [key: string]: any;
}

const Header: React.FC<HeaderProps> = (props) => {
  return <header className="h-16 bg-white border-b">Header</header>;
};

export default Header;
