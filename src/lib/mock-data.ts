export type InventoryItem = {
  id: string;
  name: string;
  warehouse: 'Bisonte SLP' | 'Exclusa SLP' | 'Eje 132' | 'Querétaro';
  quantity: number;
  value: number;
  movement: 'high' | 'medium' | 'low';
};

export type Requisition = {
  id: string;
  type: 'Requisition' | 'Transfer';
  item: string;
  quantity: number;
  from?: string;
  to: string;
  status: 'Pending' | 'Approved' | 'In Transit' | 'Completed' | 'Rejected';
  date: string;
};

export const inventoryData: InventoryItem[] = [
  { id: 'P001', name: 'Filtro de aceite P550962', warehouse: 'Bisonte SLP', quantity: 50, value: 1250, movement: 'high' },
  { id: 'P002', name: 'Batería 31T-1000', warehouse: 'Bisonte SLP', quantity: 15, value: 3750, movement: 'medium' },
  { id: 'P003', name: 'Espejo retrovisor K159-543', warehouse: 'Exclusa SLP', quantity: 5, value: 1500, movement: 'low' },
  { id: 'P004', name: 'Lámpara de faro H6024', warehouse: 'Exclusa SLP', quantity: 100, value: 500, movement: 'high' },
  { id: 'P005', name: 'Juego de balatas K049194', warehouse: 'Bisonte SLP', quantity: 20, value: 4000, movement: 'high' },
  { id: 'P006', name: 'Bomba de agua E-7345', warehouse: 'Exclusa SLP', quantity: 8, value: 2400, movement: 'medium' },
  { id: 'P007', name: 'Manguera de radiador 23-12345', warehouse: 'Bisonte SLP', quantity: 30, value: 900, movement: 'medium' },
  { id: 'P008', name: 'Alternador 8600021', warehouse: 'Querétaro', quantity: 3, value: 2100, movement: 'low' },
  { id: 'P009', name: 'Compresor de A/C T-54321', warehouse: 'Exclusa SLP', quantity: 4, value: 3200, movement: 'low' },
  { id: 'P010', name: 'Kit de embrague 108391-25', warehouse: 'Bisonte SLP', quantity: 7, value: 4900, movement: 'medium' },
];

export const requisitionData: Requisition[] = [
  { id: 'R001', type: 'Requisition', item: 'P001', quantity: 10, to: 'Servicio Rápido', status: 'Completed', date: '2024-07-20' },
  { id: 'T001', type: 'Transfer', item: 'P003', quantity: 2, from: 'Exclusa SLP', to: 'Bisonte SLP', status: 'In Transit', date: '2024-07-22' },
  { id: 'R002', type: 'Requisition', item: 'P004', quantity: 20, to: 'Servicio Rápido', status: 'Approved', date: '2024-07-23' },
  { id: 'R003', type: 'Requisition', item: 'P008', quantity: 1, to: 'Taller', status: 'Pending', date: '2024-07-24' },
  { id: 'T002', type: 'Transfer', item: 'P009', quantity: 1, from: 'Exclusa SLP', to: 'Querétaro', status: 'Rejected', date: '2024-07-19' },
  { id: 'R004', type: 'Requisition', item: 'P002', quantity: 5, to: 'Servicio Rápido', status: 'Completed', date: '2024-07-18' },
];
