import React, { useEffect, useState } from 'react';
import Form from '@rjsf/antd';
import { FormProps } from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { schemasService } from '../../services/schemas';
import { Spin } from 'antd';

export interface JsonSchemaEditorProps extends Omit<FormProps, 'schema' | 'validator'> {
  schemaName: string;
}

export const JsonSchemaEditor: React.FC<JsonSchemaEditorProps> = ({ schemaName, ...props }) => {
  const [schema, setSchema] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSchema = async () => {
      try {
        const data = await schemasService.getSchema(schemaName);
        setSchema(data);
      } catch (error) {
        console.error(`Failed to load schema: ${schemaName}`, error);
      } finally {
        setLoading(false);
      }
    };
    fetchSchema();
  }, [schemaName]);

  if (loading) {
    return <Spin tip={`Loading Schema (${schemaName})...`} />;
  }

  if (!schema) {
    return <div>Failed to load schema for {schemaName}</div>;
  }

  return (
    <Form
      {...props}
      schema={schema}
      validator={validator}
    />
  );
};
