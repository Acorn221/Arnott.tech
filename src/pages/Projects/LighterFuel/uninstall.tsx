/* eslint-disable import/prefer-default-export */
import { useEffect } from 'react';
import { AnalyticsEvent } from './GA';
import LighterFuelLogo from '@/pages/Home/Projects/assets/LighterFuel512.png';

export const LighterfuelUninstall = () => {
  useEffect(() => {
    AnalyticsEvent([{
      name: 'uninstall',
    }]);
  });

  const handleUninstallReason = (reason: string) => {
    AnalyticsEvent([{
      name: 'uninstall',
      params: reason,
    }]);
  };

  return (
    <div className="min-h-screen w-screen bg-slate-900 flex justify-center align-middle">
      <div className="m-auto flex flex-col p-4 gap-4 bg-neutral-300">
        <div className="flex justify-center align-middle">
          <h1 className="text-4xl m-auto flex-1 text-center text-black">Why Did You Uninstall Lighterfuel?</h1>
          <div className="m-auto flex justify-center align-middle flex-1">
            <img src={LighterFuelLogo} className="m-auto max-h-[10em] max-w-[10em]" alt="logo" />
          </div>
        </div>
        <iframe
          title="Uninstall Form"
          src="https://docs.google.com/forms/d/e/1FAIpQLScrVM0Lwr2a28_TBzyDDHH4tJiJQNKtl5iywvlKrr3iG9tYjg/viewform?embedded=true"
          className="h-[65vh] w-full m-auto"
        >
          Loading…

        </iframe>
      </div>
    </div>
  );
};
