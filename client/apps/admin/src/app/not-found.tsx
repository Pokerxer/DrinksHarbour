'use client';

import Link from 'next/link';
import { Button } from 'rizzui/button';
import { Title } from 'rizzui/typography';
import { PiHouseLineBold } from 'react-icons/pi';

// Completely disable static generation to avoid server component issues
export const dynamic = 'force-static';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      <div className="sticky top-0 z-40 flex justify-center py-5 backdrop-blur-lg lg:backdrop-blur-none xl:py-10">
        <Link href="/">
          <span className="text-2xl font-bold">DrinksHarbour</span>
        </Link>
      </div>

      <div className="flex grow items-center px-6 xl:px-10">
        <div className="mx-auto text-center">
          <div className="mx-auto mb-8 aspect-[360/326] max-w-[256px] xs:max-w-[370px] lg:mb-12 2xl:mb-16">
            <div className="text-6xl">😢</div>
          </div>
          <Title
            as="h1"
            className="text-[22px] font-bold leading-normal text-gray-1000 lg:text-3xl"
          >
            Sorry, the page not found
          </Title>
          <p className="mt-3 text-sm leading-loose text-gray-500 lg:mt-6 lg:text-base lg:leading-loose">
            We have been spending long hours in order to launch our new website.
            Join our mailing list or follow us on Facebook for get latest update.
          </p>
          <Link href={'/'}>
            <Button
              as="span"
              size="xl"
              color="primary"
              className="mt-8 h-12 px-4 xl:h-14 xl:px-6"
            >
              <PiHouseLineBold className="mr-1.5 text-lg" />
              Back to home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
