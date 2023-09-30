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
        <div className="flex flex-col gap-4">
          <button className="btn btn-primary" onClick={() => handleUninstallReason('not_useful')}>
            Not Useful
          </button>
          <button className="btn btn-primary" onClick={() => handleUninstallReason('not_working')}>
            Not Working
          </button>
          <button className="btn btn-primary" onClick={() => handleUninstallReason('It Got In The Way')}>
            It Got In The Way
          </button>
          <button className="btn btn-primary" onClick={() => handleUninstallReason('Other')}>
            Other
          </button>
        </div>
      </div>
    </div>
  );
};
