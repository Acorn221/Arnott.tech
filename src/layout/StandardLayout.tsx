import { Outlet } from 'react-router';

const StandardLayout = () => (
  <div className="overflow-x-hidden">
    <Outlet />
  </div>
);

export default StandardLayout;
