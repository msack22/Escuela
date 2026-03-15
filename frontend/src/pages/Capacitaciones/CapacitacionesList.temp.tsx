import React from 'react';
import { Typography } from '@mui/material';

const CapacitacionesList: React.FC<any> = (props) => {
  return (
    <div>
      <Typography variant="h4">Capacitaciones List (Temp)</Typography>
      <pre>{JSON.stringify(props, null, 2)}</pre>
    </div>
  );
};

export default CapacitacionesList;
