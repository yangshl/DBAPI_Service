import React, { useEffect, useState, useCallback } from 'react';
import { Form, Input, Select, Button, Card, message, Spin, Table, Space, Modal, Tag } from 'antd';
import { SaveOutlined, PlayCircleOutlined, ArrowLeftOutlined, SyncOutlined, EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { format } from 'sql-formatter';

interface Datasource {
  id: number;
  name: string;
  type: string;
}

interface ApiCategory {
  id: number;
  name: string;
  code: string;
  description: string;
  sort_order: number;
  status: string;
}

interface ExtractedParameter {
  param_name: string;
  param_type: 'path' | 'query' | 'body';
  data_type: 'string' | 'number' | 'boolean' | 'date';
  required: number;
  default_value?: string;
  validation_rule?: string;
  description?: string;
}

const ApiCreate: React.FC = () => {
  const [form] = Form.useForm();
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [showTestResult, setShowTestResult] = useState(false);
  const [testParams, setTestParams] = useState<Record<string, any>>({});
  const [sqlValue, setSqlValue] = useState('');
  const [extractedParams, setExtractedParams] = useState<ExtractedParameter[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [autoExtractEnabled, setAutoExtractEnabled] = useState(true);
  const [editingParam, setEditingParam] = useState<{ name: string; field: string } | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const navigate = useNavigate();
  const { id } = useParams();

  const extractParameters = useCallback(async (sql: string) => {
    if (!sql.trim()) {
      setExtractedParams([]);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/apis/extract-parameters', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sql_template: sql,
          api_id: id
        })
      });

      const data = await response.json();

      if (data.success && data.parameters) {
        setExtractedParams(data.parameters);
      }
    } catch (error) {
      console.error('Extract parameters error:', error);
    }
  }, [id]);

  useEffect(() => {
    if (autoExtractEnabled && sqlValue) {
      const timer = setTimeout(() => {
        extractParameters(sqlValue);
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [sqlValue, autoExtractEnabled, extractParameters]);

  useEffect(() => {
    fetchDatasources();
    fetchCategories();
    if (id) {
      fetchApiDetail();
    }
  }, [id]);

  const fetchDatasources = async () => {
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
      }
    } catch (error) {
      console.error('Failed to fetch datasources:', error);
    }
  };

  const fetchCategories = async () => {
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
    }
  };

  const fetchApiDetail = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/apis/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        form.setFieldsValue({
          name: data.name,
          path: data.path,
          method: data.method,
          description: data.description,
          datasource_id: data.datasource_id,
          sql_template: data.sql_template,
          status: data.status,
          require_auth: data.require_auth,
          category: data.category || 'default'
        });
        setSqlValue(data.sql_template || '');
        setTestParams({});
        
        // Load existing parameters
        if (data.parameters && data.parameters.length > 0) {
          setExtractedParams(data.parameters);
        } else {
          extractParameters(data.sql_template || '');
        }
      }
    } catch (error) {
      console.error('Failed to fetch API detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFormatSql = () => {
    try {
      const formatted = format(sqlValue);
      setSqlValue(formatted);
      form.setFieldValue('sql_template', formatted);
    } catch (error) {
      message.error('SQL格式化失败');
    }
  };

  const handleExtractParameters = async () => {
    if (!sqlValue.trim()) {
      message.warning('请先输入SQL模板');
      return;
    }

    setExtracting(true);
    await extractParameters(sqlValue);
    setExtracting(false);
    message.success('参数已更新');
  };

  const handleEditParam = (paramName: string, field: string, currentValue: string) => {
    setEditingParam({ name: paramName, field });
    setEditingValue(currentValue);
  };

  const handleSaveParam = () => {
    if (!editingParam) return;

    setExtractedParams(prev => prev.map(param => {
      if (param.param_name === editingParam.name) {
        return { ...param, [editingParam.field]: editingValue };
      }
      return param;
    }));

    setEditingParam(null);
    setEditingValue('');
    message.success('参数已更新');
  };

  const handleCancelEdit = () => {
    setEditingParam(null);
    setEditingValue('');
  };

  const handleEditorChange = (value: string | undefined) => {
    const newValue = value || '';
    setSqlValue(newValue);
    form.setFieldValue('sql_template', newValue);
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const values = await form.validateFields();
      const token = localStorage.getItem('token');

      const response = await fetch(`/api/apis/${id || 'test'}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...values,
          params: testParams
        })
      });

      const data = await response.json();
      setTestResult(data);
      setShowTestResult(true);

      if (data.success) {
        message.success('测试成功');
      } else {
        message.error('测试失败: ' + data.error);
      }
    } catch (error) {
      console.error('Test error:', error);
      message.error('测试失败');
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const token = localStorage.getItem('token');
      const url = id ? `/api/apis/${id}` : '/api/apis';
      const method = id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...values,
          parameters: extractedParams
        })
      });

      if (response.ok) {
        message.success(id ? '更新成功' : '创建成功');
        navigate('/apis');
      } else {
        const data = await response.json();
        message.error(data.error || '操作失败');
      }
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && id) {
    return <Spin style={{ display: 'block', margin: '100px auto' }} />;
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/apis')}>
          返回
        </Button>
      </div>

      <Card title={id ? '编辑API' : '创建API'}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            method: 'GET',
            status: 'draft'
          }}
        >
          <Form.Item
            label="API名称"
            name="name"
            rules={[{ required: true, message: '请输入API名称' }]}
          >
            <Input placeholder="例如: 用户列表查询" />
          </Form.Item>

          <Form.Item
            label="API路径"
            name="path"
            rules={[{ required: true, message: '请输入API路径' }]}
          >
            <Input placeholder="/api/users" addonBefore="/" />
          </Form.Item>

          <Form.Item
            label="请求方法"
            name="method"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="GET">GET</Select.Option>
              <Select.Option value="POST">POST</Select.Option>
              <Select.Option value="PUT">PUT</Select.Option>
              <Select.Option value="DELETE">DELETE</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="数据源"
            name="datasource_id"
            rules={[{ required: true, message: '请选择数据源' }]}
          >
            <Select placeholder="选择数据源">
              {datasources.map(ds => (
                <Select.Option key={ds.id} value={ds.id}>
                  {ds.name} ({ds.type})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="SQL模板"
            name="sql_template"
            rules={[{ required: true, message: '请输入SQL语句' }]}
            extra="使用 {{参数名}} 作为参数占位符"
          >
            <div className="sql-editor-container">
              <Editor
                height="400px"
                defaultLanguage="sql"
                theme="vs-dark"
                value={sqlValue}
                onChange={handleEditorChange}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  suggestOnTriggerCharacters: true,
                  quickSuggestions: true,
                  parameterHints: { enabled: true },
                  wordBasedSuggestions: 'allDocuments',
                  folding: true,
                  bracketPairColorization: { enabled: true }
                }}
              />
            </div>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button onClick={handleFormatSql}>格式化SQL</Button>
              <Button
                icon={<SyncOutlined />}
                onClick={handleExtractParameters}
                loading={extracting}
              >
                手动刷新参数
              </Button>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleTest}
                loading={testing}
                disabled={!id}
              >
                测试执行
              </Button>
            </Space>
          </Form.Item>

          <Card 
            title={
              <Space>
                <span>参数列表</span>
                <Tag color={autoExtractEnabled ? 'green' : 'default'}>
                  {autoExtractEnabled ? '自动提取' : '手动模式'}
                </Tag>
                {extracting && <SyncOutlined spin />}
              </Space>
            }
            size="small"
            extra={
              <Button 
                size="small" 
                type={autoExtractEnabled ? 'primary' : 'default'}
                onClick={() => setAutoExtractEnabled(!autoExtractEnabled)}
              >
                {autoExtractEnabled ? '关闭自动提取' : '开启自动提取'}
              </Button>
            }
          >
            {extractedParams.length > 0 ? (
              <Table
                dataSource={extractedParams}
                rowKey="param_name"
                size="small"
                pagination={false}
                columns={[
                  {
                    title: '参数名',
                    dataIndex: 'param_name',
                    key: 'param_name',
                    render: (text) => <Tag color="blue">{text}</Tag>
                  },
                  {
                    title: '参数类型',
                    dataIndex: 'param_type',
                    key: 'param_type',
                    render: (text, record) => {
                      if (editingParam?.name === record.param_name && editingParam?.field === 'param_type') {
                        return (
                          <Select
                            size="small"
                            value={editingValue}
                            onChange={(value) => setEditingValue(value)}
                            style={{ width: 100 }}
                            autoFocus
                          >
                            <Select.Option value="path">path</Select.Option>
                            <Select.Option value="query">query</Select.Option>
                            <Select.Option value="body">body</Select.Option>
                          </Select>
                        );
                      }
                      return (
                        <Space>
                          <Tag color={text === 'path' ? 'green' : text === 'query' ? 'blue' : 'orange'}>
                            {text}
                          </Tag>
                          <Button
                            type="link"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleEditParam(record.param_name, 'param_type', text)}
                          />
                        </Space>
                      );
                    }
                  },
                  {
                    title: '数据类型',
                    dataIndex: 'data_type',
                    key: 'data_type',
                    render: (text, record) => {
                      if (editingParam?.name === record.param_name && editingParam?.field === 'data_type') {
                        return (
                          <Space size="small">
                            <Select
                              size="small"
                              value={editingValue}
                              onChange={(value) => setEditingValue(value)}
                              style={{ width: 100 }}
                              autoFocus
                            >
                              <Select.Option value="string">string</Select.Option>
                              <Select.Option value="number">number</Select.Option>
                              <Select.Option value="boolean">boolean</Select.Option>
                              <Select.Option value="date">date</Select.Option>
                            </Select>
                            <Button
                              type="primary"
                              size="small"
                              icon={<CheckOutlined />}
                              onClick={handleSaveParam}
                            />
                            <Button
                              size="small"
                              icon={<CloseOutlined />}
                              onClick={handleCancelEdit}
                            />
                          </Space>
                        );
                      }
                      return (
                        <Space>
                          <Tag>{text}</Tag>
                          <Button
                            type="link"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleEditParam(record.param_name, 'data_type', text)}
                          />
                        </Space>
                      );
                    }
                  },
                  {
                    title: '必填',
                    dataIndex: 'required',
                    key: 'required',
                    render: (value, record) => {
                      if (editingParam?.name === record.param_name && editingParam?.field === 'required') {
                        return (
                          <Space size="small">
                            <Select
                              size="small"
                              value={editingValue}
                              onChange={(value) => setEditingValue(value)}
                              style={{ width: 80 }}
                              autoFocus
                            >
                              <Select.Option value="1">是</Select.Option>
                              <Select.Option value="0">否</Select.Option>
                            </Select>
                            <Button
                              type="primary"
                              size="small"
                              icon={<CheckOutlined />}
                              onClick={handleSaveParam}
                            />
                            <Button
                              size="small"
                              icon={<CloseOutlined />}
                              onClick={handleCancelEdit}
                            />
                          </Space>
                        );
                      }
                      return (
                        <Space>
                          <Tag color={value ? 'red' : 'default'}>
                            {value ? '是' : '否'}
                          </Tag>
                          <Button
                            type="link"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleEditParam(record.param_name, 'required', value.toString())}
                          />
                        </Space>
                      );
                    }
                  },
                  {
                    title: '默认值',
                    dataIndex: 'default_value',
                    key: 'default_value',
                    render: (text, record) => {
                      if (editingParam?.name === record.param_name && editingParam?.field === 'default_value') {
                        return (
                          <Space size="small">
                            <Input
                              size="small"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              style={{ width: 120 }}
                              autoFocus
                            />
                            <Button
                              type="primary"
                              size="small"
                              icon={<CheckOutlined />}
                              onClick={handleSaveParam}
                            />
                            <Button
                              size="small"
                              icon={<CloseOutlined />}
                              onClick={handleCancelEdit}
                            />
                          </Space>
                        );
                      }
                      return (
                        <Space>
                          <span>{text || '-'}</span>
                          <Button
                            type="link"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleEditParam(record.param_name, 'default_value', text || '')}
                          />
                        </Space>
                      );
                    }
                  },
                  {
                    title: '描述',
                    dataIndex: 'description',
                    key: 'description',
                    render: (text, record) => {
                      if (editingParam?.name === record.param_name && editingParam?.field === 'description') {
                        return (
                          <Space size="small">
                            <Input
                              size="small"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              style={{ width: 200 }}
                              autoFocus
                            />
                            <Button
                              type="primary"
                              size="small"
                              icon={<CheckOutlined />}
                              onClick={handleSaveParam}
                            />
                            <Button
                              size="small"
                              icon={<CloseOutlined />}
                              onClick={handleCancelEdit}
                            />
                          </Space>
                        );
                      }
                      return (
                        <Space>
                          <span>{text || '-'}</span>
                          <Button
                            type="link"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleEditParam(record.param_name, 'description', text || '')}
                          />
                        </Space>
                      );
                    }
                  }
                ]}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                {sqlValue ? '在SQL模板中使用 {{参数名}} 格式来定义参数' : '请先输入SQL模板'}
              </div>
            )}
          </Card>

          <Form.Item
            label="描述"
            name="description"
          >
            <Input.TextArea rows={3} placeholder="API描述" />
          </Form.Item>

          <Form.Item
            label="状态"
            name="status"
          >
            <Select>
              <Select.Option value="draft">草稿</Select.Option>
              <Select.Option value="published">已发布</Select.Option>
              <Select.Option value="deprecated">已废弃</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="分类"
            name="category"
            initialValue="default"
          >
            <Select>
              {categories.filter(cat => cat.status === 'active').map(cat => (
                <Select.Option key={cat.code} value={cat.code}>
                  {cat.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="是否需要鉴权"
            name="require_auth"
            initialValue={1}
          >
            <Select>
              <Select.Option value={1}>需要</Select.Option>
              <Select.Option value={0}>不需要</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSubmit}
                loading={loading}
              >
                保存
              </Button>
              <Button onClick={() => navigate('/apis')}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Modal
        title="测试结果"
        open={showTestResult}
        onCancel={() => setShowTestResult(false)}
        footer={null}
        width={800}
      >
        {testResult && (
          <div>
            <p><strong>执行时间:</strong> {testResult.executionTime}</p>
            <p><strong>返回行数:</strong> {testResult.rowCount}</p>
            {testResult.data && Array.isArray(testResult.data) && testResult.data.length > 0 && (
              <Table
                dataSource={testResult.data}
                columns={Object.keys(testResult.data[0]).map(key => ({
                  title: key,
                  dataIndex: key,
                  key: key
                }))}
                pagination={false}
                scroll={{ x: 'max-content' }}
                size="small"
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ApiCreate;
