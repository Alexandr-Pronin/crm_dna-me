/**
 * Organization Edit Component
 */
import { Edit, SimpleForm, TextInput } from 'react-admin';

const OrganizationEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="name" label="Name" fullWidth />
      <TextInput source="domain" label="Domain" fullWidth />
      <TextInput source="industry" label="Industry" fullWidth />
      <TextInput source="company_size" label="Company Size" fullWidth />
      <TextInput source="country" label="Country" fullWidth />
      <TextInput source="portal_id" label="Portal ID" fullWidth />
      <TextInput source="moco_id" label="Moco ID" fullWidth />
    </SimpleForm>
  </Edit>
);

export default OrganizationEdit;
