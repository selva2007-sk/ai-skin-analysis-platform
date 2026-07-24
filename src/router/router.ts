import { useEffect, useState } from 'react';

export const navigateTo = (path: string, replace = false) => {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const method = replace ? 'replaceState' : 'pushState';
  window.history[method](null, '', normalized);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

export const useCurrentPath = () => {
  const [path, setPath] = useState(window.location.pathname || '/');

  useEffect(() => {
    const sync = () => setPath(window.location.pathname || '/');
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  return path;
};

export const getDoctorPatientRoute = (id: string) => `/doctor/patient/${id}`;
