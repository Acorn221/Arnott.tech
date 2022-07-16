import { Outlet } from 'react-router';

const StandardLayout = () => (
  <div className="h-full">
    <Outlet />
  </div>
);

export default StandardLayout;
