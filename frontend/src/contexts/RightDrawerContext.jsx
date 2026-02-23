import React, { createContext, useContext, useState, useCallback } from 'react';

const RightDrawerContext = createContext({
  open: false,
  resource: null,
  recordId: null,
  openRecord: () => {},
  closeRecord: () => {},
  openRecordInPage: () => {},
});

export const useRightDrawer = () => useContext(RightDrawerContext);

export const RightDrawerProvider = ({ children }) => {
  const [state, setState] = useState({
    open: false,
    resource: null,
    recordId: null,
  });

  const openRecord = useCallback((resource, recordId) => {
    setState({
      open: true,
      resource,
      recordId,
    });
  }, []);

  const closeRecord = useCallback(() => {
    setState((prev) => ({
      ...prev,
      open: false,
    }));
  }, []);

  // navigate is passed or handled externally, or we can use window.location
  const openRecordInPage = useCallback((resource, recordId) => {
    closeRecord();
    window.location.hash = `#/${resource}/${recordId}/show`;
  }, [closeRecord]);

  return (
    <RightDrawerContext.Provider value={{ ...state, openRecord, closeRecord, openRecordInPage }}>
      {children}
    </RightDrawerContext.Provider>
  );
};
