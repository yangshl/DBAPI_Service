import React, { useEffect, useState } from 'react';
import { Card, Form, Select, Button, Steps, Table, Space, message, Spin, Modal, Input, Tag, Alert, Checkbox } from 'antd';
import { ArrowLeftOutlined, DatabaseOutlined, TableOutlined, ApiOutlined, CheckCircleOutlined, EyeOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

interface Datasource {
  id: number;
  name: string;
  type: string;
  host: string;
  port: number;
  database_name: string;
  status: string;
}

interface TableInfo {
  name: string;
  comment?: string;
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: string;
  comment?: string;
}

interface TableSchema {
  name: string;
  comment?: string;
  columns: ColumnInfo[];
}

interface GeneratedAPI {
  name: string;
  path: string;
  method: string;
  description: string;
  sqlTemplate: string;
  parameters?: Array<{
    param_name: string;
    param_type: string;
    data_type: string;
    required: number;
    default_value?: string;
    validation_rule?: string;
    description?: string;
  }>;
}

interface ApiCategory {
  id: number;
  name: string;
  code: string;
  description: string;
  sort_order: number;
  status: string;
}

const { Step } = Steps;
const { TextArea } = Input;

const ApiAutoGenerate: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tableSchema, setTableSchema] = useState<TableSchema | null>(null);
  const [generatedAPIs, setGeneratedAPIs] = useState<GeneratedAPI[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewAPI, setPreviewAPI] = useState<GeneratedAPI | null>(null);
  const [selectedDatasourceId, setSelectedDatasourceId] = useState<number | null>(null);
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);
  const [selectedAPIs, setSelectedAPIs] = useState<string[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDatasources();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setCategoriesLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/system/categories', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const fetchDatasources = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/datasources', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDatasources(data);
      } else {
        message.error('获取数据源列表失败');
      }
    } catch (error) {
      console.error('Failed to fetch datasources:', error);
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleDatasourceChange = async (datasourceId: number) => {
    setSelectedDatasourceId(datasourceId);
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/generator/datasources/${datasourceId}/tables`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTables(data.tables);
        form.setFieldsValue({ tableName: undefined });
        setTableSchema(null);
        setGeneratedAPIs([]);
      } else {
        message.error('获取表列表失败');
      }
    } catch (error) {
      console.error('Failed to fetch tables:', error);
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = async (tableName: string) => {
    setSelectedTableName(tableName);
    const datasourceId = form.getFieldValue('datasourceId');
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/generator/datasources/${datasourceId}/tables/${tableName}/schema`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const schema = await response.json();
        setTableSchema(schema);
      } else {
        message.error('获取表结构失败');
      }
    } catch (error) {
      console.error('Failed to fetch table schema:', error);
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    const values = await form.validateFields();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/generator/preview', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          datasourceId: values.datasourceId,
          tableName: values.tableName,
          apiName: values.apiName,
          apiPath: values.apiPath
        })
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedAPIs(data.apis);
        setSelectedAPIs(data.apis.map((api: GeneratedAPI) => `${api.method}-${api.path}`));
        setCurrentStep(2);
      } else {
        message.error('预览API失败');
      }
    } catch (error) {
      console.error('Failed to preview APIs:', error);
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (selectedAPIs.length === 0) {
      message.warning('请至少选择一个API');
      return;
    }

    const values = await form.validateFields();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/generator/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          datasourceId: selectedDatasourceId,
          tableName: selectedTableName,
          apiName: values.apiName,
          apiPath: values.apiPath,
          category: values.category,
          status: values.status,
          selectedAPIs: selectedAPIs
        })
      });

      if (response.ok) {
        const data = await response.json();
        message.success(`成功生成 ${data.apis.length} 个API`);
        navigate('/apis');
      } else if (response.status === 409) {
        const errorData = await response.json();
        Modal.error({
          title: 'API重复检测',
          content: (
            <div>
              <p>{errorData.message}</p>
              <Table
                columns={[
                  { title: 'API名称', dataIndex: 'name', key: 'name' },
                  { title: '路径', dataIndex: 'path', key: 'path', render: (path: string) => <code>{path}</code> },
                  { title: '方法', dataIndex: 'method', key: 'method', render: (method: string) => <Tag color={method === 'GET' ? 'green' : method === 'POST' ? 'blue' : method === 'PUT' ? 'orange' : 'red'}>{method}</Tag> }
                ]}
                dataSource={errorData.duplicates}
                rowKey={(record: any) => `${record.method}-${record.path}`}
                pagination={false}
                size="small"
                style={{ marginTop: 16 }}
              />
            </div>
          ),
          width: 600
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        message.error(errorData.error || '生成API失败');
      }
    } catch (error) {
      console.error('Failed to generate APIs:', error);
      message.error('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const showPreview = (api: GeneratedAPI) => {
    setPreviewAPI(api);
    setPreviewVisible(true);
  };

  const columns = [
    {
      title: '选择',
      key: 'select',
      render: (_: any, record: GeneratedAPI) => (
        <Checkbox
          checked={selectedAPIs.includes(`${record.method}-${record.path}`)}
          onChange={(e) => {
            const key = `${record.method}-${record.path}`;
            if (e.target.checked) {
              setSelectedAPIs([...selectedAPIs, key]);
            } else {
              setSelectedAPIs(selectedAPIs.filter(k => k !== key));
            }
          }}
        />
      )
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      render: (path: string) => <code>{path}</code>
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      render: (method: string) => {
        const colorMap: Record<string, string> = {
          GET: 'green',
          POST: 'blue',
          PUT: 'orange',
          DELETE: 'red'
        };
        return <Tag color={colorMap[method]}>{method}</Tag>;
      }
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '参数数量',
      dataIndex: 'parameters',
      key: 'parameters',
      render: (params?: any[]) => params?.length || 0
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: GeneratedAPI) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => showPreview(record)}
        >
          预览
        </Button>
      )
    }
  ];

  const schemaColumns = [
    {
      title: '列名',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ColumnInfo) => (
        <Space>
          {name}
          {record.isPrimaryKey && <Tag color="gold">PK</Tag>}
        </Space>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type'
    },
    {
      title: '可空',
      dataIndex: 'nullable',
      key: 'nullable',
      render: (nullable: boolean) => (nullable ? '是' : '否')
    },
    {
      title: '默认值',
      dataIndex: 'defaultValue',
      key: 'defaultValue'
    },
    {
      title: '注释',
      dataIndex: 'comment',
      key: 'comment',
      ellipsis: true
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/apis')}
        >
          返回
        </Button>
      </div>

      <Card title="API自动生成" extra={<ThunderboltOutlined />}>
        <Steps current={currentStep} style={{ marginBottom: 32 }}>
          <Step title="选择数据源和表" icon={<DatabaseOutlined />} />
          <Step title="确认表结构" icon={<TableOutlined />} />
          <Step title="预览生成的API" icon={<ApiOutlined />} />
        </Steps>

        <Spin spinning={loading}>
          {currentStep === 0 && (
            <Form form={form} layout="vertical">
              <Form.Item
                name="datasourceId"
                label="数据源"
                rules={[{ required: true, message: '请选择数据源' }]}
              >
                <Select
                  placeholder="请选择数据源"
                  onChange={handleDatasourceChange}
                  showSearch
                  optionFilterProp="children"
                >
                  {datasources.map(ds => (
                    <Select.Option key={ds.id} value={ds.id}>
                      <Space>
                        <DatabaseOutlined />
                        {ds.name} ({ds.type})
                      </Space>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="tableName"
                label="数据表"
                rules={[{ required: true, message: '请选择数据表' }]}
              >
                <Select
                  placeholder="请选择数据表"
                  onChange={handleTableChange}
                  showSearch
                  optionFilterProp="children"
                  disabled={tables.length === 0}
                >
                  {tables.map(table => (
                    <Select.Option key={table.name} value={table.name}>
                      <Space>
                        <TableOutlined />
                        {table.name}
                        {table.comment && ` - ${table.comment}`}
                      </Space>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="apiName"
                label="API名称前缀"
                tooltip="生成的API名称将使用此前缀"
              >
                <Input placeholder="例如: UserManagement" />
              </Form.Item>

              <Form.Item
                name="apiPath"
                label="API路径前缀"
                tooltip="生成的API路径将使用此前缀"
              >
                <Input placeholder="例如: /api/users" />
              </Form.Item>

              <Form.Item
                name="category"
                label="API分类"
                initialValue="default"
              >
                <Select loading={categoriesLoading}>
                  {categories.filter(cat => cat.status === 'active').map(cat => (
                    <Select.Option key={cat.code} value={cat.code}>
                      {cat.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="status"
                label="初始状态"
                initialValue="draft"
              >
                <Select>
                  <Select.Option value="draft">草稿</Select.Option>
                  <Select.Option value="published">已发布</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  onClick={handlePreview}
                  disabled={!form.getFieldValue('tableName')}
                  block
                  icon={<ThunderboltOutlined />}
                >
                  下一步：预览API
                </Button>
              </Form.Item>
            </Form>
          )}

          {currentStep === 1 && tableSchema && (
            <div>
              <Alert
                message="表结构确认"
                description="请确认表结构信息是否正确，系统将基于此结构生成API"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Card title={`表: ${tableSchema.name}`} size="small" style={{ marginBottom: 16 }}>
                <Table
                  columns={schemaColumns}
                  dataSource={tableSchema.columns}
                  rowKey="name"
                  pagination={false}
                  size="small"
                />
              </Card>

              <Space>
                <Button onClick={() => setCurrentStep(0)}>
                  上一步
                </Button>
                <Button
                  type="primary"
                  onClick={handlePreview}
                  icon={<ThunderboltOutlined />}
                >
                  下一步：预览API
                </Button>
              </Space>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <Alert
                message="API预览"
                description={`系统已为表 ${tableSchema?.name} 生成了 ${generatedAPIs.length} 个API，请确认后生成`}
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Table
                columns={columns}
                dataSource={generatedAPIs}
                rowKey={(record) => `${record.method}-${record.path}`}
                pagination={false}
              />

              <Space style={{ marginTop: 16 }}>
                <Button onClick={() => setCurrentStep(1)}>
                  上一步
                </Button>
                <Button onClick={() => setCurrentStep(0)}>
                  重新配置
                </Button>
                <Button
                  type="primary"
                  onClick={handleGenerate}
                  icon={<CheckCircleOutlined />}
                >
                  确认生成
                </Button>
              </Space>
            </div>
          )}
        </Spin>
      </Card>

      <Modal
        title={`API预览: ${previewAPI?.name}`}
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {previewAPI && (
          <div>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <strong>名称:</strong> {previewAPI.name}
              </div>
              <div>
                <strong>路径:</strong> <code>{previewAPI.path}</code>
              </div>
              <div>
                <strong>方法:</strong> <Tag color={previewAPI.method === 'GET' ? 'green' : previewAPI.method === 'POST' ? 'blue' : previewAPI.method === 'PUT' ? 'orange' : 'red'}>{previewAPI.method}</Tag>
              </div>
              <div>
                <strong>描述:</strong> {previewAPI.description}
              </div>
              <div>
                <strong>SQL模板:</strong>
                <TextArea
                  value={previewAPI.sqlTemplate}
                  readOnly
                  autoSize={{ minRows: 3, maxRows: 10 }}
                  style={{ fontFamily: 'monospace', marginTop: 8 }}
                />
              </div>
              {previewAPI.parameters && previewAPI.parameters.length > 0 && (
                <div>
                  <strong>参数:</strong>
                  <Table
                    columns={[
                      { title: '参数名', dataIndex: 'param_name', key: 'param_name' },
                      { title: '类型', dataIndex: 'data_type', key: 'data_type' },
                      { title: '位置', dataIndex: 'param_type', key: 'param_type' },
                      { title: '必填', dataIndex: 'required', key: 'required', render: (r: number) => r ? '是' : '否' },
                      { title: '描述', dataIndex: 'description', key: 'description' }
                    ]}
                    dataSource={previewAPI.parameters}
                    rowKey="param_name"
                    pagination={false}
                    size="small"
                    style={{ marginTop: 8 }}
                  />
                </div>
              )}
            </Space>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ApiAutoGenerate;
