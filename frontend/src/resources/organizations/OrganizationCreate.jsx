/**
 * Organization Create Component
 */
import { Create, SimpleForm, TextInput } from 'react-admin';

const OrganizationCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="name" label="Name" fullWidth />
      <TextInput source="domain" label="Domain" fullWidth />
      <TextInput source="industry" label="Industry" fullWidth />
      <TextInput source="company_size" label="Company Size" fullWidth />
      <TextInput source="country" label="Country" fullWidth />
      <TextInput source="portal_id" label="Portal ID" fullWidth />
      <TextInput source="moco_id" label="Moco ID" fullWidth />
    </SimpleForm>
  </Create>
);

export default OrganizationCreate;
